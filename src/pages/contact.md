---
title: contact
label: reach me out
templateEngine: [vto, md]
---

Don't hesitate to reach me out on any of these!

- [Signal]({{ author.links.find((l) => l.id === "signal")?.url }})
- [Matrix]({{ author.links.find((l) => l.id === "matrix")?.url }}) (verify device IDs first)
  {{ for device of author.social.matrix.devices }}
  - **{{ device.name }}**: `{{ device.id }}`
    {{ /for }}
- [{{ author.email }}](mailto:{{ author.email }}) (preferred encrypted with [age](/keys#SSH))
