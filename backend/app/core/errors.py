class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class ConfigurationError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code, message, 503)


class AuthenticationError(AppError):
    def __init__(self, code: str = "UNAUTHORIZED", message: str = "请先登录"):
        super().__init__(code, message, 401)


class QuotaError(AppError):
    def __init__(self, message: str):
        super().__init__("AI_QUOTA_EXHAUSTED", message, 429)

