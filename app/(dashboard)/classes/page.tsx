import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CLASSES } from "@/features/classes/mock-data";

const BATCHES = Array.from(new Set(CLASSES.map((c) => c.batch))).sort().reverse();

export default function ClassesPage() {
  return (
    <div>
      <PageHeader
        title="My Classes"
        description="Batch → Grade → Division → Subject."
      />
      <div className="p-6 md:p-8">
        <Tabs defaultValue={BATCHES[0]}>
          <TabsList>
            {BATCHES.map((b) => (
              <TabsTrigger key={b} value={b}>
                {b}
              </TabsTrigger>
            ))}
          </TabsList>
          {BATCHES.map((batch) => {
            const inBatch = CLASSES.filter((c) => c.batch === batch);
            const grades = Array.from(new Set(inBatch.map((c) => c.grade)));
            return (
              <TabsContent key={batch} value={batch} className="space-y-6">
                {grades.map((grade) => {
                  const inGrade = inBatch.filter((c) => c.grade === grade);
                  const divisions = Array.from(
                    new Set(inGrade.map((c) => c.division)),
                  );
                  return (
                    <div key={grade} className="space-y-3">
                      <h2 className="text-sm font-semibold">{grade}</h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {divisions.map((division) => (
                          <Card key={division}>
                            <CardContent className="space-y-2 p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Division {division}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {inGrade
                                  .filter((c) => c.division === division)
                                  .map((c) => (
                                    <Link
                                      key={c.id}
                                      href={`/classes/${c.id}`}
                                      className="rounded-md border border-border px-2.5 py-1 text-sm hover:border-primary hover:text-primary"
                                    >
                                      {c.subject}
                                    </Link>
                                  ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
