import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>

export function paginationOffset(p: Pagination) {
  return (p.page - 1) * p.pageSize
}
