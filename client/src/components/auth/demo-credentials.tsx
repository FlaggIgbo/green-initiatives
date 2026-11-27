import { Info } from "lucide-react";

interface DemoCredentialsProps {
  isSandbox: boolean;
}

export function DemoCredentials({ isSandbox: _isSandbox }: DemoCredentialsProps) {
  return (
    <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-md text-sm text-primary flex items-start gap-2">
      <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold mb-1">Demo Credentials:</p>
        <p>
          Username: <code className="bg-background px-1 rounded">admin</code>
        </p>
        <p>
          Password: <code className="bg-background px-1 rounded">@berrybank1</code>
        </p>
      </div>
    </div>
  );
}
