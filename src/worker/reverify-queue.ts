import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { dequeueReverifyJobWithClient, getReverifyRedisClient, releaseReverifyDedupeWithClient, requeueReverifyJobWithClient } from '../lib/reverifyQueue'
import { processReverifyJob } from '../lib/reverifyWorker'

const DEFAULT_MAX_JOBS = 10
const DEFAULT_MAX_RUNS_PER_JOB = 5
const DEFAULT_MAX_RETRIES = 2

async function main() {
  const payload = await getPayload({ config })
  const client = await getReverifyRedisClient()
  if (!client) {
    payload.logger.warn('REDIS_URL 未配置，reverify 队列 worker 跳过')
    process.exit(0)
  }

  const maxJobs = Math.max(1, Number(process.env.REVERIFY_QUEUE_MAX_JOBS || DEFAULT_MAX_JOBS))
  const maxRuns = Math.max(1, Number(process.env.REVERIFY_MAX_RUNS_PER_JOB || DEFAULT_MAX_RUNS_PER_JOB))
  const maxRetries = Math.max(0, Number(process.env.REVERIFY_MAX_RETRIES || DEFAULT_MAX_RETRIES))
  let processed = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < maxJobs; i++) {
    const job = await dequeueReverifyJobWithClient(client)
    if (!job) break

    try {
      const result = await processReverifyJob(payload, job, { maxRuns })
      processed++
      await releaseReverifyDedupeWithClient(client, job).catch(() => undefined)
      payload.logger.info(
        `复验队列完成 failure=${job.failureCaseId} user=${job.userId}: attempted=${result.attempted} ok=${result.succeeded} format=${result.formatValid} skipped=${result.skipped}`,
      )
      if (result.attempted === 0) skipped++
    } catch (e) {
      failed++
      const retry = await requeueReverifyJobWithClient(client, job, (e as Error).message, maxRetries).catch(() => ({ requeued: false, attempts: job.attempts || 0, exhausted: true }))
      if (retry.requeued) {
        payload.logger.warn(`复验队列失败后重试 failure=${job.failureCaseId} user=${job.userId}: attempt=${retry.attempts}/${maxRetries} error=${(e as Error).message}`)
      } else {
        await releaseReverifyDedupeWithClient(client, job).catch(() => undefined)
        payload.logger.error(`复验队列失败且重试耗尽 failure=${job.failureCaseId} user=${job.userId}: ${(e as Error).message}`)
      }
    }
  }

  payload.logger.info(`reverify 队列完成：处理 ${processed}，空跑 ${skipped}，失败 ${failed}`)
  process.exit(failed > 0 ? 2 : 0)
}

main().catch((e) => {
  console.error('reverify 队列 worker 失败：', e)
  process.exit(1)
})
