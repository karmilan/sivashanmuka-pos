export type Role = 'OWNER' | 'MANAGER' | 'CASHIER'

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

export interface ApiErrorDto {
  error: {
    code: string
    message: string
  }
  requestId?: string
}