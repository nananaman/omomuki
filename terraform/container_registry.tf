resource "sakuracloud_container_registry" "omomuki" {
  name            = var.container_registry_name
  subdomain_label = var.container_registry_name
  access_level    = "none"

  description = "omomuki 用コンテナレジストリ"

  user {
    name       = var.sakuracloud_registry_user
    password   = var.sakuracloud_registry_password
    permission = "all"
  }
}

output "sakuracloud_container_registry_fqdn" {
  description = "コンテナレジストリの FQDN"
  value       = sakuracloud_container_registry.omomuki.fqdn
}
