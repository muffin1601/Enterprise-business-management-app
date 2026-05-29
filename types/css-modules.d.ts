// Ambient types for CSS Module imports so `tsc --noEmit` resolves
// `import styles from './X.module.scss'`. Next's compiler handles the runtime.
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
