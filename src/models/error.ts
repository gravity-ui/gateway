export interface AppErrorArgs {
    code?: string | number;
    details?: object;
    debug?: object;
}

export interface AppErrorWrapArgs extends AppErrorArgs {
    message?: string;
}

export interface AppErrorConstructor {
    new (message?: string, args?: AppErrorArgs): Error;

    wrap: (error: Error, args?: AppErrorWrapArgs) => Error;
}
