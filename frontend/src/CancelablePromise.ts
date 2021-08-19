class CancelablePromise<T> {
  isCanceled = false;
  promise: Promise<T>;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (error: Error) => void
    ) => void
  ) {
    this.promise = new Promise((resolve, reject) => {
      const wrappedResolve = (value: T) => {
        if (!this.isCanceled) {
          resolve(value);
        }
      };

      const wrappedReject = (error: Error) => {
        if (!this.isCanceled) {
          reject(error);
        }
      };

      return executor(wrappedResolve, wrappedReject);
    });
  }

  cancel() {
    this.isCanceled = true;
  }

  then(onFulfilled: (value: T) => any, onRejected?: (error: Error) => any) {
    return this.promise.then(onFulfilled, onRejected);
  }
}

export default CancelablePromise;
