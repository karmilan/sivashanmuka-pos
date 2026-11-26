import type { CategoryListDto, CategoryListQuery } from '../../../../shared/api'
import { apiRequest } from '../../lib/api'

export function getCategories(query: CategoryListQuery): Promise<CategoryListDto> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    ...(query.active !== undefined && { active: String(query.active) }),
  })

  return apiRequest<CategoryListDto>(`/categories?${searchParams.toString()}`)
}
