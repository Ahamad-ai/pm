import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";

const noop = async () => {};

describe("ChatSidebar", () => {
  it("shows placeholder when no messages", () => {
    render(
      <ChatSidebar messages={[]} isSending={false} error={null} onSend={noop} />
    );
    expect(
      screen.getByText(/add a card/i)
    ).toBeInTheDocument();
  });

  it("renders user and assistant messages", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there" },
    ];
    render(
      <ChatSidebar messages={messages} isSending={false} error={null} onSend={noop} />
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("displays error message when error prop is set", () => {
    render(
      <ChatSidebar messages={[]} isSending={false} error="Something went wrong" onSend={noop} />
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(
      <ChatSidebar messages={[]} isSending={false} error={null} onSend={noop} />
    );
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("disables send button while sending", () => {
    render(
      <ChatSidebar messages={[]} isSending={true} error={null} onSend={noop} />
    );
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("calls onSend with trimmed message and clears input", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(async () => {});
    render(
      <ChatSidebar messages={[]} isSending={false} error={null} onSend={onSend} />
    );
    const input = screen.getByLabelText("Chat message");
    await user.type(input, "  test message  ");
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("test message");
    expect(input).toHaveValue("");
  });
});
