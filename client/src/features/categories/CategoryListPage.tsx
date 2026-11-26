import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { ApiClientError } from '../../lib/api'
import { useCategories } from './queries'

const pageSize = 50

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : 'Could not load categories. Please try again.'
}

export function CategoryListPage() {
  const [page, setPage] = useState(1)
  const categoriesQuery = useCategories({ page, pageSize })

  return (
    <section className="workspace-section" aria-labelledby="category-list-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SHARED CATALOGUE</p>
          <h2 id="category-list-heading">Categories</h2>
        </div>
        {categoriesQuery.data && (
          <span className="count-label">
            {categoriesQuery.data.total} {categoriesQuery.data.total === 1 ? 'category' : 'categories'}
          </span>
        )}
      </div>

      {categoriesQuery.isPending && (
        <p className="category-message muted" role="status" aria-live="polite">Loading categories…</p>
      )}

      {categoriesQuery.isError && (
        <div className="category-message category-error" role="alert">
          <p>{errorMessage(categoriesQuery.error)}</p>
          <Button type="button" variant="secondary" size="small" onClick={() => categoriesQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {categoriesQuery.data && categoriesQuery.data.categories.length === 0 && (
        <p className="category-message muted" role="status">No categories found.</p>
      )}

      {categoriesQuery.data && categoriesQuery.data.categories.length > 0 && (
        <ul className="category-list" aria-label="Category list">
          {categoriesQuery.data.categories.map((category) => (
            <li className="category-row" key={category.id}>
              <span className="category-name">{category.name}</span>
              <span className={`category-state ${category.active ? 'is-active' : 'is-inactive'}`}>
                {category.active ? 'Active' : 'Inactive'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {categoriesQuery.data && (
        <div className="category-pagination">
          <p className="count-label" aria-live="polite">
            {categoriesQuery.data.total === 0
              ? 'Showing 0 of 0 categories'
              : `Showing ${(categoriesQuery.data.page - 1) * categoriesQuery.data.pageSize + 1}–${Math.min(
                categoriesQuery.data.page * categoriesQuery.data.pageSize,
                categoriesQuery.data.total,
              )} of ${categoriesQuery.data.total} categories`}
          </p>
          <nav className="category-page-controls" aria-label="Category pagination">
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={categoriesQuery.data.page <= 1 || categoriesQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span aria-current="page">
              Page {categoriesQuery.data.page} of {Math.max(
                1,
                Math.ceil(categoriesQuery.data.total / categoriesQuery.data.pageSize),
              )}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={
                categoriesQuery.data.page * categoriesQuery.data.pageSize >= categoriesQuery.data.total
                || categoriesQuery.isFetching
              }
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </nav>
        </div>
      )}
    </section>
  )
}
