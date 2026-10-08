# CTKTKT interface design reference

Source: https://github.com/PanJiaChen/vue-element-admin
GitHub topic: https://github.com/topics/admin-dashboard?o=desc&s=stars
Verified through GitHub API on 2026-10-08: 90,157 stars, first in this topic.
Next results: ColorlibHQ/AdminLTE 45,640; tabler/tabler 41,831.

The original color variables and MIT license are retained here. CTKTKT adapts
the dark grouped sidebar, active blue navigation, light workspace, and card/table
presentation into its existing React components. It does not run the upstream
Vue application, upstream mock data, authentication, or calculation code.

Presentation changes are confined to app/globals.css, components/app-shell.tsx,
components/app-navigation.tsx, and components/auth-layout.tsx.
Existing fonts, data, formulas, permissions, APIs, and exports are retained.
