on run
  set changed_list to ""
  set t0 to (current date) - 1 * days
  set t1 to t0 + 90 * days
  tell application "Calendar"
    repeat with cname in {"scott@sharemorestories.com", "Community"}
      set coname to cname as text
      if writable of calendar coname then
        set evs to (every event of calendar coname whose start date ≥ t0 and start date ≤ t1)
        repeat with e in evs
          if allday event of e is false then
            set iv to {}
            repeat with a in (every display alarm of e)
              copy (trigger interval of a) to end of iv
            end repeat
            if iv does not contain -10 then
              make new display alarm at end of display alarms of e with properties {trigger interval:-10}
              set changed_list to changed_list & "added 10m | " & summary of e & linefeed
            end if
            if iv does not contain -1 then
              make new display alarm at end of display alarms of e with properties {trigger interval:-1}
              set changed_list to changed_list & "added 1m  | " & summary of e & linefeed
            end if
          end if
        end repeat
      end if
    end repeat
  end tell
  if changed_list is "" then return "all events already have 10m and 1m alerts"
  return changed_list
end run
