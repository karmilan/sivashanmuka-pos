import { useQuery } from '@tanstack/react-query'
import type { CategoryListQuery } from '../../../../shared/api'
import { getCategories } from './api'

export const categoryQueryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
  list: (query: CategoryListQuery) => [...categoryQueryKeys.lists(), query] as const,
}

export function useCategories(query: CategoryListQuery) {
  return useQuery({
    queryKey: categoryQueryKeys.list(query),
    queryFn: () => getCategories(query),
  })
}
