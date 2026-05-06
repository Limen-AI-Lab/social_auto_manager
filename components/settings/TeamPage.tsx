import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Mail,
  Shield,
  Edit,
  Eye,
  UserPlus,
  MoreVertical,
  X,
  Crown,
} from 'lucide-react';
import { TeamMember, UserRole, BusinessUnit } from '../../types';
import { Profile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../lib/supabase';
import { inviteMember } from '../../services/adminInvite';
import { updateMemberPassword } from '../../services/adminPassword';
import { fetchAllowedBusinessUnitIds, setAllowedBusinessUnits } from '../../services/profileBusinessUnits';
import { fetchBusinessUnits } from '../../services/businessUnits';

const ROLE_RANK: Record<UserRole, number> = { super_admin: 4, admin: 3, editor: 2, viewer: 1 };

function canManage(currentRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_RANK[currentRole] > ROLE_RANK[targetRole];
}

function getAllowedInviteRoles(inviterRole: UserRole): UserRole[] {
  if (inviterRole === 'super_admin') return ['admin', 'editor', 'viewer'];
  if (inviterRole === 'admin') return ['editor', 'viewer'];
  return [];
}

function getAllowedEditRoles(editorRole: UserRole): UserRole[] {
  if (editorRole === 'super_admin') return ['admin', 'editor', 'viewer'];
  if (editorRole === 'admin') return ['editor', 'viewer'];
  return [];
}

function profileToMember(p: Profile): TeamMember {
  return {
    id: p.id,
    name: p.display_name || p.email,
    email: p.email,
    role: p.role,
  };
}

const TeamPage: React.FC = () => {
  const { user, role, refreshProfile } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const canAccessTeam = role === 'super_admin' || role === 'admin';

  // Position dropdown in viewport when menu opens (for portal)
  useEffect(() => {
    if (!menuOpenId || !menuTriggerRef.current) {
      setMenuPosition(null);
      return;
    }
    const rect = menuTriggerRef.current.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 120) });
  }, [menuOpenId]);

  const fetchMembers = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('profiles')
      .select('id, email, display_name, role')
      .order('created_at', { ascending: false });
    if (e) {
      setError(e.message);
      setMembers([]);
    } else {
      setMembers((data ?? []).map((row) => profileToMember(row as Profile)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const getRoleBadge = (r: TeamMember['role']) => {
    const roleConfig: Record<TeamMember['role'], { label: string; color: string }> = {
      super_admin: { label: 'Super Admin', color: 'bg-amber-100 text-amber-800 border-amber-200' },
      admin: { label: 'Admin', color: 'bg-red-100 text-red-700 border-red-200' },
      editor: { label: 'Editor', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      viewer: { label: 'Viewer', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    const config = roleConfig[r];
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getRoleIcon = (r: TeamMember['role']) => {
    switch (r) {
      case 'super_admin':
        return <Crown size={16} className="text-amber-600" />;
      case 'admin':
        return <Shield size={16} className="text-red-600" />;
      case 'editor':
        return <Edit size={16} className="text-blue-600" />;
      case 'viewer':
        return <Eye size={16} className="text-slate-600" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Team Members</h2>
              <p className="text-sm text-slate-600">
                Manage team members and their access permissions
              </p>
            </div>
            {canAccessTeam && (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <UserPlus size={18} />
                Invite Member
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>
          )}

          {loading ? (
            <p className="text-slate-600">Loading...</p>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-200">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{member.name}</h3>
                          {getRoleIcon(member.role)}
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <Mail size={14} />
                          {member.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRoleBadge(member.role)}
                        {canAccessTeam && canManage(role, member.role) && (
                          <div className="relative">
                            <button
                              ref={menuOpenId === member.id ? menuTriggerRef : undefined}
                              type="button"
                              onClick={() => setMenuOpenId(menuOpenId === member.id ? null : member.id)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              aria-expanded={menuOpenId === member.id}
                            >
                              <MoreVertical size={18} className="text-slate-400" />
                            </button>
                            {menuOpenId === member.id && menuPosition && createPortal(
                              <>
                                <div
                                  className="fixed inset-0 z-[100]"
                                  aria-hidden
                                  onClick={() => setMenuOpenId(null)}
                                />
                                <div
                                  className="fixed z-[101] py-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[120px]"
                                  style={{ top: menuPosition.top, left: menuPosition.left }}
                                  role="menu"
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setEditMember(member);
                                      setMenuOpenId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      const supabase = getSupabase();
                                      if (supabase && member.id !== user?.id) {
                                        supabase.from('profiles').delete().eq('id', member.id).then(() => fetchMembers());
                                      }
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </>,
                              document.body
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="font-semibold text-slate-900 mb-2">Role Permissions</h4>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-amber-600" />
                <span><strong>Super Admin:</strong> Full access including Profile Key and team; cannot change own role</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-red-600" />
                <span><strong>Admin:</strong> Full access including Profile Key; can save drafts or publish directly; can manage editor and viewer</span>
              </div>
              <div className="flex items-center gap-2">
                <Edit size={16} className="text-blue-600" />
                <span><strong>Editor:</strong> Can create and edit content, save drafts only (cannot publish); no Settings or Team</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-slate-600" />
                <span><strong>Viewer:</strong> Read-only access to content and reports; no Settings or Team</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <InviteModal
          inviterRole={role}
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            setInviteOpen(false);
            fetchMembers();
            refreshProfile();
          }}
          signUp={inviteMember}
        />
      )}

      {editMember && (
        <EditMemberModal
          member={editMember}
          currentUserId={user?.id ?? null}
          currentUserRole={role}
          onClose={() => setEditMember(null)}
          onSuccess={() => {
            setEditMember(null);
            fetchMembers();
            refreshProfile();
          }}
        />
      )}
    </div>
  );
};

interface InviteModalProps {
  inviterRole: UserRole;
  onClose: () => void;
  onSuccess: () => void;
  signUp: (email: string, password: string, options?: { display_name?: string; role?: UserRole }) => Promise<void>;
}

function InviteModal({ inviterRole, onClose, onSuccess, signUp }: InviteModalProps) {
  const allowedRoles = getAllowedInviteRoles(inviterRole);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(allowedRoles[0] ?? 'viewer');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signUp(email, password, { display_name: displayName || email.split('@')[0], role: selectedRole });
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Invite Member</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              placeholder="colleague@example.com"
            />
          </div>
          <div>
            <label htmlFor="invite-name" className="block text-sm font-medium text-slate-700 mb-1">Display name</label>
            <input
              id="invite-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label htmlFor="invite-password" className="block text-sm font-medium text-slate-700 mb-1">Temporary password</label>
            <input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              id="invite-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              {allowedRoles.includes('admin') && <option value="admin">Admin</option>}
              {allowedRoles.includes('editor') && <option value="editor">Editor</option>}
              {allowedRoles.includes('viewer') && <option value="viewer">Viewer</option>}
            </select>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
              {loading ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditMemberModalProps {
  member: TeamMember;
  currentUserId: string | null;
  currentUserRole: UserRole;
  onClose: () => void;
  onSuccess: () => void;
}

function EditMemberModal({ member, currentUserId, currentUserRole, onClose, onSuccess }: EditMemberModalProps) {
  const isEditingSelf = currentUserId !== null && member.id === currentUserId;
  const allowedRoles = getAllowedEditRoles(currentUserRole);
  const [displayName, setDisplayName] = useState(member.name);
  const [selectedRole, setSelectedRole] = useState<TeamMember['role']>(member.role);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [businessUnitsList, setBusinessUnitsList] = useState<BusinessUnit[]>([]);
  const [selectedAllowedBuIds, setSelectedAllowedBuIds] = useState<string[]>([]);

  const showBuAssignment = selectedRole === 'editor' || selectedRole === 'viewer';

  useEffect(() => {
    if (!showBuAssignment) return;
    Promise.all([fetchBusinessUnits(), fetchAllowedBusinessUnitIds(member.id)]).then(([bus, ids]) => {
      setBusinessUnitsList(bus);
      setSelectedAllowedBuIds(ids);
    });
  }, [member.id, showBuAssignment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (newPassword !== confirmPassword) {
      setErr('New password and confirm password do not match');
      return;
    }
    if (newPassword.length > 0 && newPassword.length < 6) {
      setErr('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setErr('Supabase not configured');
      setLoading(false);
      return;
    }
    if (newPassword && !isEditingSelf) {
      try {
        await updateMemberPassword(member.id, newPassword);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to update password');
        setLoading(false);
        return;
      }
    }
    const payload: { display_name: string; role?: UserRole } = { display_name: displayName };
    if (!isEditingSelf && allowedRoles.includes(selectedRole)) payload.role = selectedRole;
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', member.id);
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    if (selectedRole === 'editor' || selectedRole === 'viewer') {
      const ok = await setAllowedBusinessUnits(member.id, selectedAllowedBuIds);
      if (!ok) {
        setErr('Failed to save allowed business units.');
        setLoading(false);
        return;
      }
    }
    setNewPassword('');
    setConfirmPassword('');
    onSuccess();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Edit Member</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Email: {member.email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-slate-700 mb-1">Display name</label>
            <input
              id="edit-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              placeholder="Jane Doe"
            />
          </div>
          {!isEditingSelf && allowedRoles.length > 0 && (
            <div>
              <label htmlFor="edit-role" className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                id="edit-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as TeamMember['role'])}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              >
                {allowedRoles.includes('admin') && <option value="admin">Admin</option>}
                {allowedRoles.includes('editor') && <option value="editor">Editor</option>}
                {allowedRoles.includes('viewer') && <option value="viewer">Viewer</option>}
              </select>
            </div>
          )}
          {showBuAssignment && !isEditingSelf && (
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">Allowed Business Units</span>
              <p className="text-xs text-slate-500 mb-2">
                Select which business units this {selectedRole} can see and work with.
              </p>
              <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {businessUnitsList.map((bu) => (
                  <label key={bu.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAllowedBuIds.includes(bu.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAllowedBuIds((prev) => [...prev, bu.id]);
                        } else {
                          setSelectedAllowedBuIds((prev) => prev.filter((id) => id !== bu.id));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-800">{bu.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {isEditingSelf && (
            <p className="text-sm text-slate-500">You cannot change your own role.</p>
          )}
          {!isEditingSelf && (
            <>
              <div>
                <label htmlFor="edit-password" className="block text-sm font-medium text-slate-700 mb-1">New password (optional)</label>
                <input
                  id="edit-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="edit-confirm-password" className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
                <input
                  id="edit-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                />
              </div>
            </>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeamPage;
