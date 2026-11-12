import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, SessionDto, ShopDto, UserDto } from '../../shared/api'
import { Button } from './components/ui/button'
import { ApiClientError, apiRequest, getSession } from './lib/api'
import './App.css'

type ShopList = { shops: Array<ShopDto & { role: Role }> }
type UserList = { users: UserDto[] }

function errorText(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.'
}

function LoginScreen() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const login = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiRequest<SessionDto & { csrfToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: async ({ user }) => {
      setMessage('')
      queryClient.setQueryData(['session'], { user })
      await queryClient.invalidateQueries({ queryKey: ['shops'] })
    },
    onError: (error) => setMessage(errorText(error)),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    login.mutate({ email: String(formData.get('email')), password: String(formData.get('password')) })
  }

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="Sivashanmuka POS">
        <div className="brand-mark">S</div>
        <p className="eyebrow">SIVASHANMUKA</p>
        <h1>Shop operations,<br />in one place.</h1>
        <p className="brand-caption">Two shops. One shared workspace.</p>
        <div className="login-shops" aria-hidden="true"><span>MULTY STORE</span><span>SMART SHOP</span></div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">STAFF SIGN IN</p>
          <h2>Welcome back</h2>
          <p className="muted">Use your assigned staff account to continue.</p>
          <form onSubmit={submit} className="login-form">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
            {message && <p className="form-error" role="alert">{message}</p>}
            <Button className="primary-button" type="submit" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="login-footnote">Access is limited to shops assigned to your account.</p>
        </div>
      </section>
    </main>
  )
}

function ShopWorkspace({ shops }: { shops: ShopList['shops'] }) {
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div><p className="eyebrow">YOUR ACCESS</p><h2>Assigned shops</h2></div>
        <span className="count-label">{shops.length} {shops.length === 1 ? 'shop' : 'shops'}</span>
      </div>
      <div className="shop-list">
        {shops.map((shop, index) => (
          <article className="shop-row" key={shop.id}>
            <span className={`shop-index shop-index-${index + 1}`}>0{index + 1}</span>
            <div className="shop-copy"><h3>{shop.name}</h3><p>{shop.code}</p></div>
            <span className="role-label">{shop.role}</span>
            <span className="status-dot" aria-label="Active shop" />
          </article>
        ))}
      </div>
      <p className="section-note">Shop access is assigned by an owner and enforced by the API.</p>
    </section>
  )
}

function PeopleWorkspace({ shops }: { shops: ShopList['shops'] }) {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [notice, setNotice] = useState('')
  const [selectedShops, setSelectedShops] = useState<string[]>([])
  const [role, setRole] = useState<Role>('CASHIER')
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => apiRequest<UserList>('/users') })
  const createUser = useMutation({
    mutationFn: (payload: { email: string; name: string; password: string; memberships: Array<{ shopId: string; role: Role }> }) =>
      apiRequest<{ user: UserDto }>('/users', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      formRef.current?.reset()
      setSelectedShops([])
      setRole('CASHIER')
      setNotice('Staff account created.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => setNotice(errorText(error)),
  })
  const setActive = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      apiRequest(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['users'] }) },
    onError: (error) => setNotice(errorText(error)),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createUser.mutate({
      email: String(form.get('email')),
      name: String(form.get('name')),
      password: String(form.get('password')),
      memberships: selectedShops.map((shopId) => ({ shopId, role })),
    })
  }

  function toggleShop(shopId: string) {
    setSelectedShops((current) => current.includes(shopId)
      ? current.filter((value) => value !== shopId)
      : [...current, shopId])
  }

  return (
    <section className="workspace-section people-section">
      <div className="section-heading">
        <div><p className="eyebrow">OWNER ACCESS</p><h2>Staff accounts</h2></div>
        <span className="count-label">{usersQuery.data?.users.length ?? 0} accounts</span>
      </div>
      <div className="people-layout">
        <form ref={formRef} className="staff-form" onSubmit={submit}>
          <h3>Add a staff account</h3>
          <label htmlFor="staff-name">Full name</label>
          <input id="staff-name" name="name" autoComplete="name" required maxLength={120} />
          <label htmlFor="staff-email">Email address</label>
          <input id="staff-email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="staff-password">Temporary password</label>
          <input id="staff-password" name="password" type="password" minLength={12} maxLength={72} required />
          <label htmlFor="staff-role">Role for selected shops</label>
          <select id="staff-role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="CASHIER">Cashier</option><option value="MANAGER">Shop Manager</option><option value="OWNER">Owner / Admin</option>
          </select>
          <fieldset>
            <legend>Assign shop access</legend>
            {shops.map((shop) => (
              <label className="check-row" key={shop.id}>
                <input type="checkbox" checked={selectedShops.includes(shop.id)} onChange={() => toggleShop(shop.id)} />
                <span>{shop.name}</span>
              </label>
            ))}
          </fieldset>
          {notice && <p className={createUser.isError || setActive.isError ? 'form-error' : 'form-success'} role="status">{notice}</p>}
          <Button className="primary-button" type="submit" disabled={createUser.isPending || selectedShops.length === 0}>
            {createUser.isPending ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <div className="staff-list" aria-live="polite">
          {usersQuery.isLoading && <p className="muted">Loading accounts…</p>}
          {usersQuery.isError && <p className="form-error">{errorText(usersQuery.error)}</p>}
          {usersQuery.data?.users.map((user) => (
            <article className="staff-row" key={user.id}>
              <div className="staff-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
              <div className="staff-details">
                <h3>{user.name}</h3><p>{user.email}</p>
                <div className="staff-memberships">
                  {user.memberships.map((membership) => <span key={membership.shopId}>{membership.shopName} · {membership.role}</span>)}
                </div>
              </div>
              <button className="text-button" type="button" disabled={setActive.isPending}
                onClick={() => setActive.mutate({ userId: user.id, active: !user.active })}>
                {user.active ? 'Disable' : 'Enable'}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function AccountWorkspace() {
  const formRef = useRef<HTMLFormElement>(null)
  const [notice, setNotice] = useState('')
  const changePassword = useMutation({
    mutationFn: (credentials: { currentPassword: string; newPassword: string }) =>
      apiRequest<{ csrfToken: string }>('/auth/password', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: () => {
      formRef.current?.reset()
      setNotice('Password updated. Other active sessions have been signed out.')
    },
    onError: (error) => setNotice(errorText(error)),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get('newPassword'))
    if (newPassword !== String(form.get('confirmPassword'))) {
      setNotice('New passwords do not match.')
      return
    }
    setNotice('')
    changePassword.mutate({
      currentPassword: String(form.get('currentPassword')),
      newPassword,
    })
  }

  return (
    <section className="workspace-section account-section">
      <div className="section-heading">
        <div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Change password</h2></div>
      </div>
      <form ref={formRef} className="staff-form account-form" onSubmit={submit}>
        <label htmlFor="current-password">Current password</label>
        <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
        <label htmlFor="new-password">New password</label>
        <input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
        <label htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
        {notice && <p className={changePassword.isError || notice.includes('do not match') ? 'form-error' : 'form-success'} role="status">{notice}</p>}
        <Button className="primary-button" type="submit" disabled={changePassword.isPending}>
          {changePassword.isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </section>
  )
}

function AppWorkspace({ session }: { session: SessionDto }) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'shops' | 'people' | 'account'>('shops')
  const user = session.user
  const isOwner = user.memberships.some(({ role }) => role === 'OWNER')
  const shopsQuery = useQuery({ queryKey: ['shops'], queryFn: () => apiRequest<ShopList>('/shops') })
  const logout = useMutation({
    mutationFn: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
    onSuccess: async () => { await queryClient.clear() },
  })

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="app-brand" href="#shops" onClick={() => setView('shops')}>
          <span className="brand-mark small-mark">S</span><span><strong>SIVASHANMUKA</strong><small>SHOP OPERATIONS</small></span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <button className={view === 'shops' ? 'nav-item active' : 'nav-item'} onClick={() => setView('shops')}><span className="nav-symbol">⌂</span> Shops</button>
          {isOwner && <button className={view === 'people' ? 'nav-item active' : 'nav-item'} onClick={() => setView('people')}><span className="nav-symbol">◎</span> Staff accounts</button>}
          <button className={view === 'account' ? 'nav-item active' : 'nav-item'} onClick={() => setView('account')}><span className="nav-symbol">◉</span> Account</button>
        </nav>
        <div className="sidebar-bottom">
          <span className="online-indicator"><i /> API workspace</span>
          <button className="nav-item logout-button" onClick={() => logout.mutate()} disabled={logout.isPending}><span className="nav-symbol">↗</span> Sign out</button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {view === 'shops' ? 'Shops' : view === 'people' ? 'Staff accounts' : 'Account'}</div>
          <div className="profile-chip"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
        </header>
        <div className="page-content">
          <div className="page-title"><div><p className="eyebrow">PHASE 1 · FOUNDATION</p><h1>{view === 'shops' ? 'Your workspace' : view === 'people' ? 'People & access' : 'Your account'}</h1></div><span className="secure-label"><i /> Secure session</span></div>
          {shopsQuery.isLoading && <p className="muted">Loading your assigned shops…</p>}
          {shopsQuery.isError && <p className="form-error" role="alert">{errorText(shopsQuery.error)}</p>}
          {shopsQuery.data && view === 'shops' && <ShopWorkspace shops={shopsQuery.data.shops} />}
          {shopsQuery.data && view === 'people' && isOwner && <PeopleWorkspace shops={shopsQuery.data.shops} />}
          {view === 'account' && <AccountWorkspace />}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: getSession, retry: false })
  if (sessionQuery.isLoading) return <main className="loading-screen">Opening your workspace…</main>
  if (sessionQuery.data) return <AppWorkspace session={sessionQuery.data} />
  return <LoginScreen />
}
