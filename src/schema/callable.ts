export interface Call<Self extends (...args: any[]) => any> {
  (...args: Parameters<Self>): ReturnType<Self>
}

export declare const Callable: {
  new <Self extends (...args: any[]) => any>(
    self: Self
  ): {
    (...args: Parameters<Self>): ReturnType<Self>
  }
}
