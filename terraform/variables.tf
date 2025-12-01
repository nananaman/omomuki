variable "sakuracloud_access_key_id" {
  type      = string
  sensitive = true
}

variable "sakuracloud_access_key_secret" {
  type      = string
  sensitive = true
}

variable "sakuracloud_registry_user" {
  type = string
}

variable "sakuracloud_registry_password" {
  type      = string
  sensitive = true
}

variable "api_key" {
  type      = string
  sensitive = true
}

variable "container_registry_name" {
  type        = string
  description = "コンテナレジストリのサブドメイン名（グローバルで一意）"
}
