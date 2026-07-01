import type { UIField } from 'payload'

// 列表行内操作列：状态切换（按集合，见 RowActions 内 TOGGLES）+ 删除。
// 统一复用，避免在各集合重复声明。
export function rowActionsField(collection: string): UIField {
  return {
    name: 'rowActions',
    type: 'ui',
    label: '操作',
    admin: {
      components: {
        Cell: {
          path: '/components/admin/RowActions#RowActions',
          clientProps: { collection },
        },
      },
    },
  }
}
