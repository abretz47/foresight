declare module '*.yaml' {
  const value: {
    shots: Array<{
      name: string;
      distance: string;
      targetRadius: string;
      missRadius: string;
    }>;
  };
  export = value;
}

declare module '*.yml' {
  const value: {
    shots: Array<{
      name: string;
      distance: string;
      targetRadius: string;
      missRadius: string;
    }>;
  };
  export = value;
}
