import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import {
  KeyboardShortcutsHelp,
  useKeyboardShortcuts,
  type ShortcutHandlers,
} from "@/components/KeyboardShortcuts";

const Harness = (props: ShortcutHandlers) => {
  useKeyboardShortcuts(props);
  return <div data-testid="harness">harness</div>;
};

describe("useKeyboardShortcuts", () => {
  it("calls onShowHelp when ? is pressed", async () => {
    const onShowHelp = vi.fn();
    render(<Harness onShowHelp={onShowHelp} />);
    await userEvent.keyboard("?");
    expect(onShowHelp).toHaveBeenCalled();
  });

  it("calls onFocusSearch when / is pressed", async () => {
    const onFocusSearch = vi.fn();
    render(<Harness onFocusSearch={onFocusSearch} />);
    await userEvent.keyboard("/");
    expect(onFocusSearch).toHaveBeenCalled();
  });

  it("supports the 'g b' two-key chord for board view", async () => {
    const onShowBoard = vi.fn();
    render(<Harness onShowBoard={onShowBoard} />);
    await userEvent.keyboard("g");
    await userEvent.keyboard("b");
    expect(onShowBoard).toHaveBeenCalled();
  });

  it("supports the 'g c' two-key chord for calendar view", async () => {
    const onShowCalendar = vi.fn();
    render(<Harness onShowCalendar={onShowCalendar} />);
    await userEvent.keyboard("gc");
    expect(onShowCalendar).toHaveBeenCalled();
  });

  it("does not fire when typing in an input", async () => {
    const onShowHelp = vi.fn();
    const InputHarness = () => {
      useKeyboardShortcuts({ onShowHelp });
      useEffect(() => {
        document.getElementById("typing")?.focus();
      }, []);
      return <input id="typing" defaultValue="" aria-label="typing" />;
    };
    render(<InputHarness />);
    await userEvent.keyboard("?");
    expect(onShowHelp).not.toHaveBeenCalled();
  });

  it("toggles bulk-select on 'b'", async () => {
    const onToggleBulkSelect = vi.fn();
    render(<Harness onToggleBulkSelect={onToggleBulkSelect} />);
    await userEvent.keyboard("b");
    expect(onToggleBulkSelect).toHaveBeenCalled();
  });
});

describe("KeyboardShortcutsHelp", () => {
  it("renders the shortcut table when open", () => {
    render(
      <KeyboardShortcutsHelp isOpen={true} onClose={() => undefined} />
    );
    expect(screen.getByTestId("shortcuts-overlay")).toBeInTheDocument();
    expect(screen.getByText(/Show this help/)).toBeInTheDocument();
    expect(screen.getByText(/Toggle bulk-select mode/)).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <KeyboardShortcutsHelp isOpen={false} onClose={() => undefined} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHelp isOpen={true} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
