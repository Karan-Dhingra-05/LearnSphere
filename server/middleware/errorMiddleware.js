const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const isProduction = process.env.NODE_ENV === 'production';

  // Controllers set a specific 4xx status before throwing their own safe,
  // user-facing message (e.g. "Document not found."). Anything that surfaces
  // as a 5xx is an unexpected/internal failure — never forward its raw
  // message or stack to the client in production, but keep it in the
  // server logs for debugging.
  if (statusCode >= 500) {
    console.error(err.stack);
  }
  const safeMessage = statusCode >= 500 && isProduction ? GENERIC_MESSAGE : err.message;

  res.status(statusCode).json({
    message: safeMessage,
    stack: isProduction ? null : err.stack,
  });
};

export { notFound, errorHandler };
