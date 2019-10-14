const ErrorHandler = {
  alert: (error) => {
    if (typeof error === 'string' || error instanceof String) {
      alert(new Error(error));
    }
    else if (error.status) {
      alert(new Error(error.status + ' ' + error.message));
    }
  }
};

export default ErrorHandler;