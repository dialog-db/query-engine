// We define this as const because in TS we can't define a callable class
export declare const ICallable: {
  new <Self extends (...args: any[]) => any>(
    self: Self
  ): {
    (...args: Parameters<Self>): ReturnType<Self>
  }
}

// We need to declare a class or generated typedefs strip out things that make
// subclasses appear non-callable.
export declare class Callable<Self extends (...args: any[]) => any> extends ICallable<Self> {
}
