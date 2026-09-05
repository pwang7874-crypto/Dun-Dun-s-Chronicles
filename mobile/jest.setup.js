/* global jest */
global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-image-analysis', () => ({
  isSupported: () => ({ subjectLifting: false }),
  extractSubject: jest.fn(),
  clearSubjectCache: jest.fn(async () => 0),
}));
