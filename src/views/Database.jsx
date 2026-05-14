import React from "react";
import DatabaseProfile from "./DatabaseProfile";

// My students → Teaching profile is the only surface for now. The
// Students / Attendance / Grades tabs are hidden until they're built
// out; the tab bar is gone so the page renders the profile directly.
export default function Database() {
  return (
    <div>
      <DatabaseProfile />
    </div>
  );
}
