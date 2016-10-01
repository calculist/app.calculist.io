class ItemManager

  def initialize(list_id)
    if list_id.is_a?(List)
      @list = list_id
      @list_id = @list.id
    elsif list_id.is_a?(Integer)
      @list_id = list_id
    else
      raise "unexpected input: #{list_id}"
    end
  end

  def get_tree
    children_by_parent_guid = {}
    items = Item.where(list_id: @list_id, is_deleted: false).order(:sort_order)
    top_item = nil
    if items.length == 0 && Item.where(list_id: @list_id).pluck('count(*)') == [0]
      top_item = Item.create!(guid: SecureRandom.uuid,
                              list_id: @list_id,
                              parent_guid: nil,
                              sort_order: 100,
                              text: list.title || 'Untitled Document',
                              is_collapsed: false,
                              is_deleted: false,
                              is_top_item: true,
                              list_update_id: 0,
                              initial_list_update_id: 0)
    end
    items.each do |item|
      if item.is_top_item
        if top_item
          raise('unexpected top item')
        else
          top_item = item
        end
      else
        children_by_parent_guid[item.parent_guid] ||= []
        children_by_parent_guid[item.parent_guid] << item
      end
    end
    raise('no top item found') if top_item.nil?
    generate_tree(top_item, children_by_parent_guid)
  end

  def get_recently_deleted(days_ago = 1)
    items = Item.where(
              list_id: @list_id,
              is_deleted: true
            ).where(
              'updated_at > ?',
              Date.today - days_ago.days
            ).order('list_update_id desc, sort_order')
    list_update_ids = []
    items_by_list_update_id = {}
    children_by_parent_guid_by_list_update_id = {}
    items.each do |item|
      luid = item.list_update_id
      if list_update_ids[-1] != luid
        list_update_ids << luid
        items_by_list_update_id[luid] = []
        children_by_parent_guid_by_list_update_id[luid] = {}
      end
      items_by_list_update_id[luid] << item
      children_by_parent_guid_by_list_update_id[luid][item.parent_guid] ||= []
      children_by_parent_guid_by_list_update_id[luid][item.parent_guid] << item
    end
    list_update_ids.map do |luid|
      item_zero = items_by_list_update_id[luid][0]
      updated_at = item_zero.updated_at
      guids = items_by_list_update_id[luid].map(&:guid)
      parent_guids = items_by_list_update_id[luid].map(&:parent_guid).uniq
      non_deleted_parent_guids = parent_guids - guids
      first_children = non_deleted_parent_guids.map do |parent_guid|
        children_by_parent_guid_by_list_update_id[luid][parent_guid]
      end
      first_children.flatten!
      trees = first_children.map do |first_child|
        generate_tree(first_child, children_by_parent_guid_by_list_update_id[luid])
      end
      {
        luid: luid,
        updated_at: updated_at,
        items: trees
      }
    end
  end

  def create_items_from_tree(tree)
    if list.items.pluck('count(*)')[0] > 0
      raise "list #{@list_id} already has items" # TODO be smarter and check for parent_guid on tree
    end
    item_data = parse_json(tree)
    list_update_id = (list.update_count || 0) + 1
    bulk_create_items(item_data, list_update_id)
  end

  def bulk_create_items(item_data, list_update_id)
    return if item_data.empty?
    data_columns = [:list_id, :guid, :parent_guid, :sort_order, :text, :is_collapsed, :is_top_item, :is_deleted]
    list_update_id_columns = [:initial_list_update_id, :list_update_id]
    time_stamp_columns = [:created_at, :updated_at]

    time_stamp = Item::sanitize(DateTime.now)

    inserts = item_data.map do |data|
      # TODO Add validations here. We are currently assuming that
      # these values have already been validated.
      values = data_columns.map {|c| Item::sanitize(data[c]) }
      values += [list_update_id, list_update_id]
      values += [time_stamp, time_stamp]
      "(#{values.join(',')})"
    end

    columns = data_columns + list_update_id_columns + time_stamp_columns
    # Using one big sql insert for perf
    sql = "INSERT INTO items (`#{columns.join('`,`')}`) VALUES #{inserts.join(',')}"
    Item.transaction do
      Item.connection.execute(sql)
      list.update_count = list_update_id
      list.save!
    end
  end

  def parse_json(json)
    tree = json.is_a?(Hash) ? json : JSON.parse(json)
    items = []
    items << parse_tree(tree, items)
    items
  end

  def update_items(items_data, list_update_id = nil)
    items_data = items_data.select do |item_data|
      # FIXME This is hacky. Fix this.
      !item_data[:guid].starts_with?('do_not_save') &&
      (item_data[:parent_guid] ? !item_data[:parent_guid].starts_with?('do_not_save') : true)
    end
    items_data.sort_by!{|item_data| item_data[:guid]}
    guids = items_data.pluck(:guid)
    existing_items = Item.where(list_id: @list_id, guid: guids).order(:guid).to_a
    existing_guids = existing_items.pluck(:guid)
    new_guids = guids - existing_guids
    if existing_guids.empty?
      is_new_item = -> (guid) { true }
    elsif new_guids.empty?
      is_new_item = -> (guid) { false }
    elsif new_guids.length > existing_guids.length
      is_new_item = -> (guid) { !existing_guids.include?(guid) }
    else
      is_new_item = -> (guid) { new_guids.include?(guid) }
    end
    new_items_data = []
    updated_items = []
    items_data.each do |item_data|
      if is_new_item.call(item_data[:guid])
        new_items_data << {
          guid: item_data[:guid],
          list_id: @list_id,
          initial_list_update_id: list_update_id,
          list_update_id: list_update_id,
          parent_guid: item_data[:parent_guid],
          sort_order: item_data[:sort_order],
          text: item_data[:text],
          is_collapsed: item_data[:collapsed],
          is_deleted: false
        }
      else
        # NOTE Because existing_items and items_data are both sorted by guid,
        # we know that the next item in existing_items will match item_data.
        item = existing_items.shift
        raise 'unexpected item' if item.guid != item_data[:guid]
        item.text = item_data[:text] if item_data[:text]
        item.is_collapsed = item_data[:is_collapsed] if item_data.has_key?(:is_collapsed)
        item.is_deleted = item_data[:is_deleted] if item_data.has_key?(:is_deleted)
        item.parent_guid = item_data[:parent_guid] if item_data[:parent_guid]
        item.sort_order = item_data[:sort_order] if item_data[:sort_order]
        item.initial_list_update_id = list_update_id if item.initial_list_update_id.nil? && list_update_id
        item.list_update_id = list_update_id if list_update_id
        updated_items << item
      end
    end
    # TODO Determine if using a transaction is actually a good idea or not.
    # Need a better understanding of what the tradeoffs are.
    Item.transaction do
      bulk_create_items(new_items_data, list_update_id)
      updated_items.each do |item|
        if item.looks_valid?
          item.save!(validate: false) # Skipping full validation for perf
        else
          item.save!
        end
      end
    end
  end

  private

  def list
    @list ||= List.find(@list_id)
  end

  def parse_tree(tree, items, parent_guid = nil, sort_order = nil)
    item = {
      list_id: @list_id,
      guid: tree['guid'] || tree[:guid] || SecureRandom.uuid,
      parent_guid: parent_guid,
      sort_order: sort_order || 100,
      text: tree['text'] || tree[:text] || '',
      is_collapsed: tree['collapsed'] || tree[:collapsed],
      is_top_item: parent_guid.nil?,
      is_deleted: false
    }
    item_items = tree['$items'] || tree[:items]
    if item_items
      item_items.each_with_index do |_item, i|
        items << parse_tree(_item, items, item[:guid], (i + 1) * 100)
      end
    end
    item
  end

  def generate_tree(item, children_by_parent_guid)
    tree = {
      '$items' => [],
      'guid' => item.guid,
      'text' => item.text,
      'collapsed' => item.is_collapsed,
      'sort_order' => item.sort_order
    }
    children = children_by_parent_guid[item.guid] || []
    children.each do |child|
      tree['$items'] << generate_tree(child, children_by_parent_guid)
    end
    tree
  end

end
