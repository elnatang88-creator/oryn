export type Plan = 'free' | 'pro' | 'elite'
export type CardStyle = 'noir' | 'midnight' | 'forest' | 'slate'
export type WalletPassType = 'apple' | 'google'

export interface Profile {
  id: string
  username: string
  full_name: string | null
  title: string | null
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  linkedin_url: string | null
  twitter_url: string | null
  instagram_url: string | null
  bio: string | null
  avatar_url: string | null
  card_style: CardStyle
  is_active: boolean
  is_admin: boolean
  plan: Plan
  total_views: number
  total_leads: number
  created_at: string
  updated_at: string
}

export interface CardView {
  id: string
  profile_id: string
  viewer_ip: string | null
  viewer_city: string | null
  viewer_country: string | null
  viewer_device: string | null
  viewer_browser: string | null
  referrer: string | null
  created_at: string
}

export interface Lead {
  id: string
  profile_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  message: string | null
  source: string
  is_read: boolean
  created_at: string
}

export interface WalletPass {
  id: string
  profile_id: string
  pass_type: WalletPassType
  pass_identifier: string | null
  created_at: string
}

export interface AnalyticsSummary {
  total_views: number
  total_leads: number
  views_today: number
  views_this_week: number
  views_this_month: number
  leads_this_month: number
  top_countries: { country: string; count: number }[]
  top_devices: { device: string; count: number }[]
  views_by_day: { date: string; count: number }[]
}

export interface AdminStats {
  total_users: number
  active_users: number
  pro_users: number
  elite_users: number
  total_views_platform: number
  total_leads_platform: number
  new_users_today: number
}
