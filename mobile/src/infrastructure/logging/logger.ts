type LogFields = Record<string, string | number | boolean | undefined>;

const sanitize = (fields: LogFields): LogFields =>
  Object.fromEntries(
    Object.entries(fields).filter(
      ([key]) =>
        !['uri', 'path', 'note', 'shopName', 'city', 'beverageName'].includes(
          key,
        ),
    ),
  );

export const logger = {
  info(event: string, fields: LogFields = {}): void {
    if (__DEV__) {
      console.info(`[DrinkDiary] ${event}`, sanitize(fields));
    }
  },
  error(event: string, fields: LogFields = {}): void {
    console.error(`[DrinkDiary] ${event}`, sanitize(fields));
  },
};
