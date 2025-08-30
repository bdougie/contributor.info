import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function WidgetGallerySkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-8 bg-muted animate-pulse rounded w-64 mx-auto mb-4" />
          <div className="h-4 bg-muted animate-pulse rounded w-96 mx-auto mb-2" />
          <div className="h-4 bg-muted animate-pulse rounded w-80 mx-auto" />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="h-6 bg-muted animate-pulse rounded w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-24" />
                  <div className="h-10 bg-muted animate-pulse rounded" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded w-16" />
                    <div className="h-10 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded w-16" />
                    <div className="h-10 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Widget Preview */}
          <div className="space-y-6">
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="space-y-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted animate-pulse rounded" />
                        <div>
                          <div className="h-4 bg-muted animate-pulse rounded w-32 mb-1" />
                          <div className="h-3 bg-muted animate-pulse rounded w-24" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="text-center p-3 border rounded">
                            <div className="h-6 bg-muted animate-pulse rounded w-12 mx-auto mb-1" />
                            <div className="h-3 bg-muted animate-pulse rounded w-16 mx-auto" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="code">
                <Card>
                  <CardContent className="p-4">
                    <div className="bg-muted rounded p-4 space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-3 bg-background animate-pulse rounded w-full" style={{
                          width: `${Math.random() * 40 + 60}%`
                        }} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}