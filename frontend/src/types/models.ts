// Domain model types matching backend schemas

// ==================== Individual Names ====================
export interface IndividualName {
  id: number;
  name_type?: string;
  given_name?: string;
  family_name?: string;
  prefix?: string;
  suffix?: string;
  name_order?: number;
}

export interface IndividualNameCreate {
  name_type?: string;
  given_name?: string;
  family_name?: string;
  prefix?: string;
  suffix?: string;
  name_order?: number;
}

// ==================== Individuals ====================
export interface Individual {
  id: number;
  gedcom_id?: string;
  sex_code?: string;
  birth_date?: string;
  birth_date_approx?: string;
  birth_place?: string;
  death_date?: string;
  death_date_approx?: string;
  death_place?: string;
  notes?: string;
  names: IndividualName[];
}

export interface IndividualCreate {
  gedcom_id?: string;
  sex_code?: string;
  birth_date?: string;
  birth_date_approx?: string;
  birth_place?: string;
  death_date?: string;
  death_date_approx?: string;
  death_place?: string;
  notes?: string;
  names: IndividualNameCreate[];
}

export interface IndividualUpdate extends Partial<IndividualCreate> {}

// ==================== Family Members ====================
export interface FamilyMember {
  family_id: number;
  individual_id: number;
  role?: string;
}

export interface FamilyMemberCreate {
  individual_id: number;
  role?: string;
}

// ==================== Family Children ====================
export interface FamilyChild {
  family_id: number;
  child_id: number;
}

export interface FamilyChildCreate {
  child_id: number;
}

// ==================== Families ====================
export interface Family {
  id: number;
  gedcom_id?: string;
  marriage_date?: string;
  marriage_date_approx?: string;
  marriage_place?: string;
  divorce_date?: string;
  divorce_date_approx?: string;
  family_type?: string;
  notes?: string;
  members: FamilyMember[];
  children: FamilyChild[];
}

export interface FamilyCreate {
  gedcom_id?: string;
  marriage_date?: string;
  marriage_date_approx?: string;
  marriage_place?: string;
  divorce_date?: string;
  divorce_date_approx?: string;
  family_type?: string;
  notes?: string;
  members: FamilyMemberCreate[];
  children: FamilyChildCreate[];
}

export interface FamilyUpdate extends Partial<FamilyCreate> {}

// ==================== Events ====================
export interface Event {
  id: number;
  individual_id?: number;
  family_id?: number;
  event_type_code: string;
  event_date?: string;
  event_date_approx?: string;
  event_place?: string;
  description?: string;
}

export interface EventCreate {
  individual_id?: number;
  family_id?: number;
  event_type_code: string;
  event_date?: string;
  event_date_approx?: string;
  event_place?: string;
  description?: string;
}

export interface EventUpdate extends Partial<EventCreate> {}

// ==================== Media ====================
export interface Media {
  id: number;
  individual_id?: number;
  family_id?: number;
  file_path?: string;
  media_type_code?: string;
  media_date?: string;
  media_date_approx?: string;
  description?: string;
  is_default?: boolean;
  age_on_photo?: number;
}

export interface MediaCreate {
  individual_id?: number;
  family_id?: number;
  file_path?: string;
  media_type_code?: string;
  media_date?: string;
  media_date_approx?: string;
  description?: string;
  is_default?: boolean;
  age_on_photo?: number;
}

export interface MediaUpdate extends Partial<MediaCreate> {}

// ==================== Lookup Types ====================
export interface LookupType {
  code: string;
  description: string;
}

// ==================== Auth Types ====================
export interface User {
  id: number;
  username: string;
  email?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SetPasswordRequest {
  token: string;
  password: string;
}

// ==================== Admin Types ====================
export interface CreateUserRequest {
  username: string;
  email?: string;
}

export interface CreateUserResponse {
  user: User;
  invitation_link: string;
}

// ==================== Tree Visualization ====================
export interface TreeNodeEvent {
  event_type: string;
  event_date?: string;
  event_date_approx?: string;
  event_place?: string;
  description?: string;
}

export interface TreeNodePhoto {
  url: string;
  age?: number;
  is_default: boolean;
}

export interface TreeNode {
  id: number;
  gedcom_id?: string;
  sex_code?: string;
  display_name: string;
  birth_date?: string;
  birth_date_approx?: string;
  death_date?: string;
  death_date_approx?: string;
  photo_url?: string;
  photos: TreeNodePhoto[];
  generation: number;
  events: TreeNodeEvent[];
}

export interface TreeEdge {
  parent_id: number;
  child_id: number;
  family_id: number;
  relationship: 'biological' | 'non-biological';
}

export interface TreeCouple {
  family_id: number;
  partner_ids: number[];
  marriage_date?: string;
  marriage_date_approx?: string;
  divorce_date?: string;
  family_type?: string;
}

export interface TreeData {
  focus_id: number;
  max_ancestor_depth: number;
  max_descendant_depth: number;
  nodes: TreeNode[];
  edges: TreeEdge[];
  couples: TreeCouple[];
}

// ==================== Statistics ====================
export interface DatabaseStats {
  individuals_count: number;
  families_count: number;
  events_count: number;
  media_count: number;
}

