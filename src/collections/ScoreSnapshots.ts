import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'
import { publicScoreSnapshotWhere } from '@/lib/scoreSnapshotPublic'

// 分数快照（四面墙·信任加固 6j-2）：localScore 变化时落一条 ed25519 签名的 append-only 记录。
// 改历史分数必留痕——中立评测历史不可无痕改写，"连续无篡改天数"本身是后来者无法回填的资产。
// 严格 append-only：update/delete 一律禁止（含管理员面板）。
export const ScoreSnapshots: CollectionConfig = {
  slug: 'score-snapshots',
  labels: { singular: '分数快照', plural: '分数快照' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['skill', 'localScore', 'reportCount', 'keyId', 'createdAt'],
    group: '系统设置',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.accountStatus !== 'banned' && (user?.role === 'admin' || user?.role === 'reviewer')) return true
      return publicScoreSnapshotWhere()
    }, // 公开可验仅限 public/published Skill；私有分数快照不能被集合 REST 枚举。
    create: isAdmin, // 仅服务端 overrideAccess
    update: () => false, // append-only：永不可改
    delete: () => false, // append-only：永不可删
  },
  fields: [
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true, index: true, label: 'Skill' },
    { name: 'localScore', type: 'number', required: true, label: '兼容分' },
    { name: 'reportCount', type: 'number', label: '快照时报告数' },
    { name: 'payloadHash', type: 'text', label: '规范化载荷哈希(sha256)' },
    { name: 'keyId', type: 'text', label: '签名密钥 ID' },
    { name: 'signature', type: 'text', label: 'ed25519 签名(base64)' },
    { name: 'signedAt', type: 'text', label: '签名时刻(载荷内)' },
  ],
}
