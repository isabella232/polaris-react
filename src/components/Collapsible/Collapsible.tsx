import React, {useState, useRef, useEffect} from 'react';

import {classNames} from '../../utilities/css';

import styles from './Collapsible.scss';

interface Transition {
  /** Assign a transition duration to the collapsible animation. */
  duration?: string;
  /** Assign a transition timing function to the collapsible animation */
  timingFunction?: string;
}

export interface CollapsibleProps {
  /** Assign a unique ID to the collapsible. For accessibility, pass this ID as the value of the triggering component’s aria-controls prop. */
  id: string;
  /** Option to show collapsible content when printing */
  expandOnPrint?: boolean;
  /** Toggle whether the collapsible is expanded or not. */
  open: boolean;
  /** Assign transition properties to the collapsible */
  transition?: Transition;
  /** The content to display inside the collapsible. */
  children?: React.ReactNode;
}

export function Collapsible({
  id,
  expandOnPrint,
  open,
  transition,
  children,
}: CollapsibleProps) {
  const [height, setHeight] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const collapisbleContainer = useRef(null);

  const transitionProperties = transition
    ? {
        transitionDuration: `${transition.duration}`,
        transitionTimingFunction: `${transition.timingFunction}`,
      }
    : null;

  const wrapperClassName = classNames(
    styles.Collapsible,
    expandOnPrint && styles.expandOnPrint,
    open && styles.open,
    isAnimating && styles.animating,
  );

  const getHeight = (element: HTMLElement | null) => {
    return element && open ? element.scrollHeight : 0;
  };

  useEffect(() => {
    const height = getHeight(collapisbleContainer.current);
    setIsAnimating(true);
    setHeight(height);
  }, [open]);

  return (
    <div
      id={id}
      aria-hidden={!open}
      style={{
        maxHeight: `${height}px`,
        ...transitionProperties,
      }}
      className={wrapperClassName}
      onTransitionEnd={() => setIsAnimating(false)}
    >
      <div ref={collapisbleContainer}>{children}</div>
    </div>
  );
}
