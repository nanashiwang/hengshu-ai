import { getPayload } from 'payload'
import config from '@payload-config'

// 统一获取 Payload Local API 客户端（getPayload 内部已做单例缓存）
export const getPayloadClient = () => getPayload({ config })
