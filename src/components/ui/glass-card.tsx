import type {HTMLAttributes,ReactNode} from "react";
export function GlassCard({children,className="",...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){return <div className={`glass-card ${className}`} {...props}>{children}</div>}
export function Pill({children,active=false}:{children:ReactNode;active?:boolean}){return <span className={`ui-pill${active?" active":""}`}>{children}</span>}
