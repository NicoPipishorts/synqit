import { useQuery } from '@tanstack/react-query';

import { useAuthSession } from './useAuthSession';
import { isPersonalInfoIdentityComplete } from '../lib/personal-info';
import { fetchPersonalInfo, queryKeys } from '../lib/queries';
import type { StoredAuth } from '../lib/types';

export const useProfileCompletion = (authOverride?: StoredAuth | null) => {
  const { auth: sessionAuth } = useAuthSession();
  const auth = authOverride ?? sessionAuth;
  const personalInfoQuery = useQuery({
    queryKey: queryKeys.personalInfo.detail(),
    queryFn: fetchPersonalInfo,
    enabled: Boolean(auth),
  });

  const personalInfo = personalInfoQuery.data ?? null;
  const isPersonalInfoComplete = isPersonalInfoIdentityComplete(personalInfo);
  const showPersonalInfoPrompt =
    Boolean(auth) && personalInfoQuery.isSuccess && !isPersonalInfoComplete;

  return {
    personalInfo,
    personalInfoQuery,
    isPersonalInfoComplete,
    showPersonalInfoPrompt,
  };
};
