export type Role = 'OWNER' | 'MANAGER' | 'CASHIER'
export type ProductUnit = 'PIECE' | 'KILOGRAM' | 'GRAM' | 'LITRE' | 'MILLILITRE' | 'PACKET' | 'BOX'

export interface ShopDto {
  id: string
  code: string
  name: string
}

export interface MembershipDto {
  shopId: string
  shopName: string
  role: Role
}

export interface UserDto {
  id: string
  email: string
  name: string
  active: boolean
  memberships: MembershipDto[]
}

export interface SessionDto {
  user: UserDto
}

export interface LoginResponseDto extends SessionDto {
  csrfToken: string
}

export interface ShopListDto {
  shops: Array<ShopDto & { role: Role }>
}

export interface UserListDto {
  users: UserDto[]
}

export interface CategoryDto {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryListDto {
  categories: CategoryDto[]
  page: number
  pageSize: number
  total: number
}

export interface CategoryListQuery {
  page: number
  pageSize: number
  active?: boolean
}

export interface ProductBarcodeDto {
  id: string
  productId: string
  barcode: string
  type: string
  createdAt: string
}

export interface ProductDto {
  id: string
  sku: string | null
  name: string
  categoryId: string | null
  baseUnit: ProductUnit
  isWeighted: boolean
  quantityPrecision: number
  defaultCost: string | null
  defaultSellingPrice: string
  active: boolean
  tracksExpiry: boolean
  /** All barcode aliases for this product, ordered by creation time. */
  barcodes: ProductBarcodeDto[]
  createdAt: string
  updatedAt: string
}

export interface ProductListDto {
  products: ProductDto[]
  page: number
  pageSize: number
  total: number
}

export interface ApiErrorDto {
  error: {
    code: string
    message: string
  }
  requestId?: string
}