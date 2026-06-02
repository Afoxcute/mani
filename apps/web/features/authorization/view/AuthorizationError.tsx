'use client'

import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthorizationErrorProps {
  error: string
}

/**
 * Error state component for the authorization flow
 * Displays OAuth validation errors or fetch failures
 */
export function AuthorizationError({ error }: AuthorizationErrorProps) {
  return (
    <div className="container max-w-lg mx-auto py-16 px-4">
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          Authorization Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">
            The MCP connection failed. The full response details are shown below so you can debug the exact failure.
          </p>
          <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted p-3 text-xs leading-5 whitespace-pre-wrap break-words">
            {error}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
