export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

//useEffect
export const PassiveEffect = 0b0001000;
//useRef
export const Ref = 0b0010000;

export const MutationMask = Placement | Update | ChildDeletion;

export const PassiveMask = PassiveEffect | ChildDeletion;
