type PersonalInfoIdentity = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

const normalizePersonalInfoField = (value?: string | null): string => value?.trim() ?? '';

export const isPersonalInfoIdentityComplete = (value?: PersonalInfoIdentity | null): boolean => {
  if (!value) {
    return false;
  }

  return (
    normalizePersonalInfoField(value.displayName).length > 0 &&
    normalizePersonalInfoField(value.firstName).length > 0 &&
    normalizePersonalInfoField(value.lastName).length > 0
  );
};
