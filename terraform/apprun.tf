resource "sakuracloud_apprun_application" "app" {
  name            = "omomuki"
  timeout_seconds = 300
  port            = 3000
  min_scale       = 0
  max_scale       = 1

  components {
    name       = "app"
    max_cpu    = "1"
    max_memory = "256Mi"

    deploy_source {
      container_registry {
        image    = "${sakuracloud_container_registry.omomuki.fqdn}/app:latest"
        server   = sakuracloud_container_registry.omomuki.fqdn
        username = var.sakuracloud_registry_user
        password = var.sakuracloud_registry_password
      }
    }

    env {
      key   = "API_KEY"
      value = var.api_key
    }
  }

  traffics {
    version_index = 0
    percent       = 100
  }
}

output "sakuracloud_apprun_api_url" {
  description = "AppRun APIの公開URL"
  value       = sakuracloud_apprun_application.app.public_url
}
