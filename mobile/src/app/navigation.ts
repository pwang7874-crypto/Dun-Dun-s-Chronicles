export type RootStackParamList = {
  Onboarding: { replay?: boolean } | undefined;
  MainTabs: undefined;
  PhotoSource: undefined;
  Editor: { recordId: string };
  Detail: { recordId: string };
  StampAlbum: undefined;
  Account: undefined;
  Membership: undefined;
  PrivacyData: undefined;
  Search: undefined;
  Passport: undefined;
  MonthlyRecap: undefined;
};

export type MainTabParamList = {
  Diary: undefined;
  Create: { recordId?: string } | undefined;
  Publish: { recordId?: string; dayKey?: string } | undefined;
  Profile: undefined;
};
