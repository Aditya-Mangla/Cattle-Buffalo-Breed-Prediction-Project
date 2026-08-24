class ApiError extends Error{
    constructor(
        statusCode,
        data=null,
        message="Something went wrong",
        error=[],
        errStack=""
    ){
        super(message)
        this.statusCode = statusCode
        this.message = message
        this.error = error

        if(errStack){
            this.errStack = errStack
        } else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export {ApiError}
