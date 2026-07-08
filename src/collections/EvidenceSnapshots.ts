import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'

// Evidence Snapshot：Passport / FailureCase / Adapter 的证据 hash 签名快照。
// append-only，为后续公开外锚和第三方验真打地基。
export const EvidenceSnapshots: CollectionConfig = {
  slug: 'evidence-snapshots',
  labels: { singular: '证据快照', plural: '证据快照' },
  indexes: [{ fields: ['targetType', 'targetId'] }],
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['targetType', 'targetId', 'evidenceHash', 'keyId', 'createdAt'],
    group: '可信与兼容',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'targetType',
      type: 'select',
      required: true,
      index: true,
      label: '对象类型',
      options: [
        { label: 'Skill Passport', value: 'skill_passport' },
        { label: 'Failure Case', value: 'failure_case' },
        { label: 'Adapter Profile', value: 'adapter_profile' },
      ],
    },
    { name: 'targetId', type: 'text', required: true, index: true, label: '对象 ID' },
    { name: 'evidenceHash', type: 'text', required: true, index: true, label: '证据 Hash' },
    { name: 'targetSummary', type: 'json', label: '公开对象摘要' },
    { name: 'payloadHash', type: 'text', label: '规范化载荷哈希(sha256)' },
    { name: 'keyId', type: 'text', label: '签名密钥 ID' },
    { name: 'signature', type: 'text', label: 'ed25519 签名(base64)' },
    { name: 'signedAt', type: 'text', label: '签名时刻(载荷内)' },
  ],
}
