export function notFound(req, res) {
  res.status(404).json({error:{code:'NOT_FOUND',message:'Route not found'}});
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(error.statusCode || 500).json({
    error:{code:error.code || 'INTERNAL_ERROR',message:error.statusCode ? error.message : 'Internal server error'}
  });
}
