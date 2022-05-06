const STATE = {
  // states of the promise
  FULFILLED: "fulfilled",
  REJECTED: "rejected",
  PENDING: "pending",
};

class MyPromise {
  // we define a constructor and pass a calback func to it which contain our resolve and reject states.

  #thencbs = []; // empty array to store the callbacks passed to then.
  #catchcbs = []; // empty array to store the callbacks passed to catch.
  #state = STATE.PENDING; // info about the current state of the promise (pending, rejected, fulfilled).
  #value; // the value passed into the function onSuccess and onFail.

  #onSuccessBind = this.#onSuccess.bind(this); // to properly bind the this variable to amke sure its hooked up.
  #onFailBind = this.#onFail.bind(this);

  constructor(cb) {
    // our callback as discussed above will have two states: on Success state and on Failure state.
    try {
      cb(this.#onSuccessBind, this.#onFailBind); // work as resolve, reject
    } catch (error) {
      this.#onFail(error);
    }
  }

  #runCallbacks() {
    if (this.#state === STATE.FULFILLED) {
      this.#thencbs.forEach((cb) => {
        cb(this.#value); // run all then cbs for success state
      });
    }

    this.#thencbs = []; // remove all the cbs after execution to avoid re-running them.

    if (this.#state === STATE.REJECTED) {
      this.#catchcbs.forEach((cb) => {
        cb(this.#value); // run all catch cbs for fail state
      });
    }
    this.#catchcbs = []; // remove all the cbs after execution to avoid re-running them.
  }

  // defining the two states (private methods)
  #onSuccess(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return; // as we want resolve and reject to run only once in a promise.

      // promise can contain more promises inside them so to handle them we call then after checking that it is indeed a instance of a promise.
      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind);
        return;
      }
      this.#value = value;
      this.#state = STATE.FULFILLED; // changing states as per success or fail
      this.#runCallbacks();
    });
  }

  #onFail(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return; // as we want resolve and reject to run only once in a promise.

      // promise can contain more promises inside them so to handle them we call then after checking that it is indeed a instance of a promise.
      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind);
        return;
      }

      // when the code gives a error but no catch is provided.
      if (this.#catchcbs.length === 0) {
        throw new UncaughtPromiseError(value);
      }

      this.#value = value;
      this.#state = STATE.REJECTED; // changing states as per success or fail
      this.#runCallbacks();
    });
  }

  // Promises contain public methods like then, catch, finally...
  then(thencb, catchcb) {
    // contains a callback with next set of actions to be performed.
    // we define an array of callbacks because a promise can have multiple callback uppon successful execution.

    return new MyPromise((resolve, reject) => {
      // push callback on to the array for execution on success state.
      this.#thencbs.push(result => {
        // in case we dont care avobt the successtate, and only care about fail state, or in other words our thencb is null we directly resolve the promise.
        if (thencb == null) {
          resolve(result);
          return;
        }

        // but if thencb is not null.
        try {
          resolve(thencb(result));
        } catch (error) {
          reject(error);
        }
      });

      // push callback on to the array for execution on fail state.
      this.#catchcbs.push(result => {
        // in case we dont care avobt the rejectstate, and only care about success state, or in other words our catchcb is null we directly reject the promise.
        if (catchcb == null) {
          reject(result);
          return;
        }

        // but if catchcb is not null.
        try {
          resolve(catchcb(result));
        } catch (error) {
          reject(error);
        }
      });
      this.#runCallbacks(); // when there are still  callbacks left to run even after the state is changed to fullfilled.
    });
  }

  catch(cb) {
    // calling the then method with thencb as undefined and catchcb as given cb.
    return this.then(undefined, cb);
  }

  finally(cb) {
    return this.then(
      (result) => {
        cb();
        return result;
      },
      (result) => {
        cb();
        throw result;
      }
    );
  }

  static resolve(value) {
    // resolve the promise
    return new Promise((resolve, reject) => {
      resolve(value);
    });
  }

  static reject(value) {
    // reject the promise
    return new Promise((resolve, reject) => {
      reject(value);
    });
  }

  // static func to resolve all promises in the passed promises array and return the array of results.
  // if any one promise fails we immediately reject.
  static all(promises) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then((value) => {
            completedPromises++;
            results[i] = value;
            if (completedPromises === promises.length) {
              resolve(results);
            }
          })
          .catch(reject);
      }
    });
  }

  // static func to resolve all promises in the passed promises array and return the array of results.
  // but here if we resolve everyPromise and store value for success and reason for failure.
  static allSettled(promises) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((resolve) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then((value) => {
            results[i] = { status: STATE.FULFILLED, value };
          })
          .catch((reason) => {
            results[i] = { status: STATE.REJECTED, reason };
          })
          .finally(() => {
            completedPromises++;
            if (completedPromises === promises.length) {
              resolve(results);
            }
          });
      }
    });
  }

  // returns the first promise that runs in success state.
  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach((promise) => {
        promise.then(resolve).catch(reject);
      });
    });
  }

  // returns the set of all promises that resturn a fail state. 
  static any(promises) {
    const errors = [];
    let rejectedPromises = 0;
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise.then(resolve).catch((value) => {
          rejectedPromises++;
          errors[i] = value;
          if (rejectedPromises === promises.length) {
            reject(new AggregateError(errors, 'All promises were rejected'));
          }
        });
      }
    });
  }
}

// Custom error class to throw error in case any promise gives error.
class UncaughtPromiseError extends Error {
  constructor(error) {
    super(error);

    this.stack = `(in promise) ${error.stack}`;
  }
}

module.exports = MyPromise;
