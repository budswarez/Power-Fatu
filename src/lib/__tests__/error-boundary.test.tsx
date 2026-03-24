import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../../components/error-boundary";

// Suppress console.error noise from intentional throws
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

// Stable component that throws on demand via prop
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error from component");
  return <div>Componente funcionando</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Componente funcionando")).toBeInTheDocument();
  });

  it("shows default fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(screen.getByText(/Test error from component/)).toBeInTheDocument();
  });

  it("shows custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Erro customizado</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Erro customizado")).toBeInTheDocument();
    expect(screen.queryByText("Algo deu errado")).not.toBeInTheDocument();
  });

  it("renders retry button in fallback UI", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(
      screen.getByRole("button", { name: /tentar novamente/i })
    ).toBeInTheDocument();
  });

  it("calls handleReset and clears error state when retry is clicked", () => {
    // Use a flag in a wrapper to control whether child throws after reset
    let throwOnRender = true;

    function ControlledChild() {
      if (throwOnRender) throw new Error("Initial error");
      return <div>Recuperado com sucesso</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ControlledChild />
      </ErrorBoundary>
    );

    // Error boundary caught the error
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();

    // Disable throwing before clicking retry
    throwOnRender = false;
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));

    rerender(
      <ErrorBoundary>
        <ControlledChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Recuperado com sucesso")).toBeInTheDocument();
  });

  it("catches different error types", () => {
    function RuntimeErrorChild() {
      throw new TypeError("Type mismatch");
      // eslint-disable-next-line no-unreachable
      return null;
    }

    render(
      <ErrorBoundary>
        <RuntimeErrorChild />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Type mismatch/)).toBeInTheDocument();
  });
});
