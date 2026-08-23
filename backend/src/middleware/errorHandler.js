// const notFound = (req, res, next) => {
//   res.status(404);
//   next(new Error(`Route not found: ${req.originalUrl}`));
// };

// // eslint-disable-next-line no-unused-vars
// const errorHandler = (err, req, res, next) => {
//   let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
//   let message = err.message || 'Server error';

//   // Multer file-size / type errors
//   if (err.name === 'MulterError') {
//     statusCode = 400;
//   }

//   // Mongoose bad ObjectId
//   if (err.name === 'CastError' && err.kind === 'ObjectId') {
//     statusCode = 404;
//     message = 'Resource not found';
//   }

//   // Mongoose duplicate key
//   if (err.code === 11000) {
//     statusCode = 400;
//     message = `Duplicate value for field: ${Object.keys(err.keyValue || {}).join(', ')}`;
//   }

//   res.status(statusCode).json({
//     success: false,
//     message,
//     stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
//   });
// };

// export { notFound, errorHandler };
