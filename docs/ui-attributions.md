# UI component sources

Kiro adapts these publicly available Aceternity UI components:

- [File Upload](https://ui.aceternity.com/components/file-upload): dropzone, upload tile, and animated file details. Adapted to controlled single-file selection, validation, removal, keyboard access, reduced motion, and Kiro's semantic CSS tokens.
- [Stateful Button](https://ui.aceternity.com/components/stateful-button): animated loading/check feedback. State is controlled by the real operation; failed requests never display success.
- [Animated Modal](https://ui.aceternity.com/components/animated-modal): entering and exiting surface motion. Kiro retains native dialog semantics and uses restrained 180ms transitions with reduced-motion support.

Source: Aceternity UI by Aceternity Labs. Registry sources reviewed on 2026-10-08. Styling is adapted locally; no Tailwind or icon framework is required.

## Icons

Interface icons use [Hugeicons Free](https://hugeicons.com/docs/integrations/react/quick-start), via `@hugeicons/react` and `@hugeicons/core-free-icons`. Stroke Rounded icons are rendered through the local `WorkspaceIcon` wrapper. The Kiro brand mark remains custom.
