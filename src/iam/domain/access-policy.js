export const canManage = (profile) => profile?.role === 'coordinator';
export const canView = (profile, shipment) => !!profile && (canManage(profile) || (profile.role === 'cargo-client' && shipment.customerId === profile.id));
